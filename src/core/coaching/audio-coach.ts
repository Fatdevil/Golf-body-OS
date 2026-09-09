/**
 * Audio Coach Service for Golf Body OS.
 * Manages text-to-speech synthesis using Web Speech API with cooldown,
 * priority queuing, and multi-language voice selection.
 */

import { CoachingPhraseKey, getPhrase, SupportedLanguage } from './i18n/locales';

export type CuePriority = 'LOW' | 'NORMAL' | 'HIGH';

export type CoachingMode = 'GUIDED' | 'CORRECTIVE' | 'REPS_ONLY' | 'MUTED' | 'FULL';

export const PACING_KEYS: CoachingPhraseKey[] = [
  'ROTATE_LEFT',
  'HOLD_POSITION',
  'RETURN_CENTER',
  'ROTATE_RIGHT',
  'CUE_HINGE_DOWN',
  'CUE_DRIVE_UP',
];

export interface SpokenCueLogEntry {
  timestampMs: number;
  key: CoachingPhraseKey;
  text: string;
  language: SupportedLanguage;
  priority: CuePriority;
}

export interface AudioCoachConfig {
  defaultLanguage?: SupportedLanguage;
  formCooldownMs?: number;
  isMuted?: boolean;
  mode?: CoachingMode;
  onSpoken?: (entry: SpokenCueLogEntry) => void;
}

export class AudioCoachService {
  private language: SupportedLanguage = 'en-US';
  private mode: CoachingMode = 'GUIDED';
  private formCooldownMs: number = 3500;
  private lastFormCueTimeMs: number = -1;
  private lastSpokenKey: CoachingPhraseKey | null = null;
  private history: SpokenCueLogEntry[] = [];
  private onSpokenCallback?: (entry: SpokenCueLogEntry) => void;

  private activeUtterances: Set<any> = new Set();
  private isSequenceCancelled: boolean = false;

  constructor(config: AudioCoachConfig = {}) {
    if (config.defaultLanguage) this.language = config.defaultLanguage;
    if (config.formCooldownMs !== undefined) this.formCooldownMs = config.formCooldownMs;
    if (config.mode !== undefined) {
      this.mode = config.mode;
    } else if (config.isMuted) {
      this.mode = 'MUTED';
    }
    if (config.onSpoken) this.onSpokenCallback = config.onSpoken;
  }

  public setLanguage(lang: SupportedLanguage): void {
    this.language = lang;
  }

  public getLanguage(): SupportedLanguage {
    return this.language;
  }

  public setMode(mode: CoachingMode): void {
    this.mode = mode;
  }

  public getMode(): CoachingMode {
    return this.mode;
  }

  public setMuted(muted: boolean): void {
    if (muted) {
      this.mode = 'MUTED';
      this.cancel();
    } else if (this.mode === 'MUTED') {
      this.mode = 'GUIDED';
    }
  }

  public getMuted(): boolean {
    return this.mode === 'MUTED';
  }

  /**
   * Speaks a coaching phrase if conditions (mode, unmuted, cooldown, priority) are met.
   */
  public speak(
    key: CoachingPhraseKey,
    priority: CuePriority = 'NORMAL',
    nowMs?: number,
    onEnd?: () => void
  ): boolean {
    const timeMs = nowMs !== undefined ? nowMs : (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (this.mode === 'MUTED') {
      onEnd?.();
      return false;
    }

    // In REPS_ONLY mode: only milestones and countdowns speak (no pacing, no form cues)
    if (this.mode === 'REPS_ONLY' && (PACING_KEYS.includes(key) || priority !== 'HIGH')) {
      onEnd?.();
      return false;
    }

    // In CORRECTIVE mode: skip pacing cues so user moves in own tempo; only speak form corrections & milestones
    if (this.mode === 'CORRECTIVE' && PACING_KEYS.includes(key)) {
      onEnd?.();
      return false;
    }

    if (typeof window === 'undefined' || !window.speechSynthesis) {
      onEnd?.();
      return false;
    }

    // Throttle low and normal form cues to prevent voice chatter
    if (priority !== 'HIGH' && this.lastFormCueTimeMs >= 0) {
      if (timeMs - this.lastFormCueTimeMs < this.formCooldownMs) {
        onEnd?.();
        return false;
      }
      if (this.lastSpokenKey === key && timeMs - this.lastFormCueTimeMs < this.formCooldownMs * 1.5) {
        onEnd?.();
        return false;
      }
    }

    const text = getPhrase(key, this.language);
    if (!text) {
      onEnd?.();
      return false;
    }

    try {
      if (priority === 'HIGH') {
        window.speechSynthesis.cancel(); // Cancel any ongoing form chatter
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = this.language;
      utterance.rate = 1.05; // Slightly brisk, clear coaching pace
      utterance.pitch = 1.0;

      // Match voice if available
      const voices = window.speechSynthesis.getVoices();
      const targetLangPrefix = this.language.slice(0, 2);
      const matchedVoice = voices.find(v => v.lang.startsWith(this.language) || v.lang.startsWith(targetLangPrefix));
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }

      this.activeUtterances.add(utterance);
      const cleanup = () => {
        this.activeUtterances.delete(utterance);
        if (onEnd) onEnd();
      };

      utterance.onend = cleanup;
      utterance.onerror = cleanup;

      this.lastFormCueTimeMs = timeMs;
      this.lastSpokenKey = key;

      const entry: SpokenCueLogEntry = {
        timestampMs: timeMs,
        key,
        text,
        language: this.language,
        priority
      };
      this.history.push(entry);
      console.log(`[AudioCoach] [${this.language}] Spoken: "${text}" (${key}, priority: ${priority})`);

      if (this.onSpokenCallback) {
        this.onSpokenCallback(entry);
      }

      window.speechSynthesis.speak(utterance);

      return true;
    } catch {
      onEnd?.();
      return false;
    }
  }

  /**
   * Speaks an ordered sequence of coaching phrases consecutively.
   */
  public speakSequence(
    keys: CoachingPhraseKey[],
    onComplete?: () => void,
    priority: CuePriority = 'HIGH'
  ): void {
    this.isSequenceCancelled = false;
    if (this.mode === 'MUTED' || keys.length === 0) {
      onComplete?.();
      return;
    }

    const playNext = (index: number) => {
      if (this.isSequenceCancelled || index >= keys.length) {
        onComplete?.();
        return;
      }
      const key = keys[index];
      const spoken = this.speak(key, priority, undefined, () => {
        if (!this.isSequenceCancelled) {
          playNext(index + 1);
        } else {
          onComplete?.();
        }
      });
      if (!spoken) {
        if (!this.isSequenceCancelled) {
          playNext(index + 1);
        } else {
          onComplete?.();
        }
      }
    };

    playNext(0);
  }

  public isSpeaking(): boolean {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      return window.speechSynthesis.speaking;
    }
    return false;
  }

  public getHistory(): SpokenCueLogEntry[] {
    return [...this.history];
  }

  public clearHistory(): void {
    this.history = [];
  }

  public onSpoken(callback: (entry: SpokenCueLogEntry) => void): void {
    this.onSpokenCallback = callback;
  }

  public cancel(): void {
    this.isSequenceCancelled = true;
    this.activeUtterances.clear();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  public reset(): void {
    this.cancel();
    this.lastFormCueTimeMs = -1;
    this.lastSpokenKey = null;
  }

  /**
   * Plays a crisp, melodic 3-note ascending chord (C5 -> E5 -> G5) to signal checkpoint lock.
   */
  public playSuccessChime(): void {
    if (this.mode === 'MUTED' || typeof window === 'undefined') return;
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;
      const ctx = new AudioCtxClass();
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      const now = ctx.currentTime;

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);

        gain.gain.setValueAtTime(0, now + idx * 0.07);
        gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.07 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.36);
      });
    } catch {
      // Audio context might be restricted before user interaction
    }
  }

  /**
   * Plays a single sine tone at the given frequency and duration.
   */
  public playTone(freq: number, durationMs: number = 150): void {
    if (this.mode === 'MUTED' || typeof window === 'undefined') return;
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;
      const ctx = new AudioCtxClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + durationMs / 1000);
    } catch {
      // Audio autoplay policy
    }
  }
}

