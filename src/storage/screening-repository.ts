/**
 * Screening Session Repository — Offline Storage & History
 *
 * Persists and retrieves physical screening sessions and historical progression.
 * Uses expo-file-system where available, with in-memory caching and fallback
 * for testing and zero-overhead execution.
 *
 * @module screening-repository
 * @version SCREENING_REPOSITORY_V1
 */

import * as FileSystem from 'expo-file-system';
import { GolfBodyTier } from '../core/metrics/golf-body-score';

export const VERSION = 'SCREENING_REPOSITORY_V1';

export type ScreeningTestType = 'HIP_HINGE' | 'THORACIC_ROTATION' | 'FULL_BATTERY';

export interface StoredScreeningSession {
  id: string;
  timestampMs: number;
  testType: ScreeningTestType;
  golfBodyScore: number; // 0–100
  tier: GolfBodyTier;
  tierLabel: string;
  tierColor: string;
  subScores: {
    hipHinge: number; // 0–50
    thoracicRotation: number; // 0–50
  };
  angles: {
    hipHingeFlexionDeg?: number;
    hipHingeKneeDeg?: number;
    thoracicRightDeg?: number;
    thoracicLeftDeg?: number;
    thoracicAsymmetryDeg?: number;
    pelvicTurnDeg?: number;
  };
  compensations: string[];
  primaryBottlenecks: string[];
  predictedSwingFaults: Array<{
    faultId: string;
    title: string;
    explanation: string;
    prescription: string;
  }>;
  prescribedExercises: Array<{
    name: string;
    targetFault: string;
    setsReps: string;
    description: string;
  }>;
}

const STORAGE_FILE_NAME = 'screening_history_v1.json';

class ScreeningRepository {
  private cache: StoredScreeningSession[] = [];
  private isLoaded: boolean = false;
  private memoryOnly: boolean = false;

  constructor(memoryOnly = false) {
    this.memoryOnly = memoryOnly;
  }

  private getFilePath(): string | null {
    if (this.memoryOnly) return null;
    try {
      const docDir = (FileSystem as any).documentDirectory;
      if (!docDir) return null;
      return `${docDir}${STORAGE_FILE_NAME}`;
    } catch {
      return null;
    }
  }

  /**
   * Initializes and loads sessions from disk into memory cache.
   */
  public async loadSessions(): Promise<StoredScreeningSession[]> {
    if (this.isLoaded) {
      return [...this.cache];
    }

    const filePath = this.getFilePath();
    if (!filePath) {
      this.isLoaded = true;
      return [...this.cache];
    }

    try {
      const info = await FileSystem.getInfoAsync(filePath);
      if (info.exists) {
        const content = await FileSystem.readAsStringAsync(filePath);
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          this.cache = parsed;
        }
      }
    } catch (err) {
      console.warn('[ScreeningRepository] Could not read sessions from disk, using memory cache:', err);
    }

    this.isLoaded = true;
    return [...this.cache];
  }

  /**
   * Returns all stored sessions sorted with most recent first.
   */
  public async getSessions(): Promise<StoredScreeningSession[]> {
    await this.loadSessions();
    return [...this.cache].sort((a, b) => b.timestampMs - a.timestampMs);
  }

  /**
   * Synchronously returns cached sessions (for instant UI render).
   */
  public getCachedSessions(): StoredScreeningSession[] {
    return [...this.cache].sort((a, b) => b.timestampMs - a.timestampMs);
  }

  /**
   * Returns the most recent session or null.
   */
  public async getLatestSession(): Promise<StoredScreeningSession | null> {
    const sessions = await this.getSessions();
    return (sessions.length > 0 && sessions[0]) ? sessions[0] : null;
  }

  /**
   * Saves a new session to memory and persists to disk.
   */
  public async saveSession(session: StoredScreeningSession): Promise<void> {
    await this.loadSessions();

    // Deduplicate or insert
    const existingIdx = this.cache.findIndex(s => s.id === session.id);
    if (existingIdx >= 0) {
      this.cache[existingIdx] = session;
    } else {
      this.cache.unshift(session);
    }

    // Keep max 50 sessions in history
    if (this.cache.length > 50) {
      this.cache = this.cache.slice(0, 50);
    }

    const filePath = this.getFilePath();
    if (filePath) {
      try {
        await FileSystem.writeAsStringAsync(filePath, JSON.stringify(this.cache, null, 2));
      } catch (err) {
        console.warn('[ScreeningRepository] Could not write session to disk:', err);
      }
    }
  }

  /**
   * Clears all session history.
   */
  public async clearHistory(): Promise<void> {
    this.cache = [];
    this.isLoaded = true;
    const filePath = this.getFilePath();
    if (filePath) {
      try {
        const info = await FileSystem.getInfoAsync(filePath);
        if (info.exists) {
          await FileSystem.deleteAsync(filePath);
        }
      } catch (err) {
        console.warn('[ScreeningRepository] Could not delete session file:', err);
      }
    }
  }
}

export const screeningRepository = new ScreeningRepository();
export { ScreeningRepository };
